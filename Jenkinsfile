pipeline {
    agent any

    environment {
        BACKEND_DIR = "/home/t_admin/Backend"
        FRONTEND_DIR = "/var/www/html"
        REPO_URL = "https://github.com/Gajarla/Ensure_test.git"
        GIT_CRED = "github-token"
    }

    triggers {
        githubPush()    // Auto build on GitHub push
    }

    stages {

        stage('Checkout Code') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main'], [name: '*/backend'], [name: '*/Frontend']],
                    userRemoteConfigs: [[url: REPO_URL, credentialsId: GIT_CRED]]
                ])
            }
        }

        /* ────────────────────────────────────────────
           BACKEND DEPLOYMENT
           ──────────────────────────────────────────── */
        stage('Deploy Backend') {
            steps {
                script {
                    echo "🚀 Deploying Backend..."

                    sh """
                    echo "Copy Backend files..."
                    sudo rm -rf ${BACKEND_DIR}
                    sudo mkdir -p ${BACKEND_DIR}
                    sudo cp -r Backend/* ${BACKEND_DIR}/

                    cd ${BACKEND_DIR}
                    sudo npm install

cat <<EOF | sudo tee ${BACKEND_DIR}/.env
APP_ENV=demo
MONGOURI=mongodb://teadmin:sailoteadm1n@16.112.109.41:27017/tedb
APP_URL=http://app.testensure.com
JENKINS_HOST=http://16.112.109.41:8080
NODE_TLS_REJECT_UNAUTHORIZED="0"
EOF

                    sudo forever stopall || true
                    sudo forever start server.js
                    """

                    echo "✔ Backend deployed successfully."
                }
            }
        }

        /* ────────────────────────────────────────────
           FRONTEND DEPLOYMENT
           ──────────────────────────────────────────── */
        stage('Deploy Frontend') {
            steps {
                script {
                    echo "🚀 Deploying Frontend..."

                    sh """
                    cd Frontend
                    npm install
                    npm run build

                    sudo rm -rf ${FRONTEND_DIR}/*
                    sudo cp -r build/* ${FRONTEND_DIR}/

                    sudo systemctl restart apache2 || sudo systemctl restart httpd
                    """

                    echo "✔ Frontend deployed successfully."
                }
            }
        }
    }

    post {
        success { echo "🎉 Full Deployment Completed Successfully!" }
        failure { echo "❌ Deployment Failed!" }
    }
}
